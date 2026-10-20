/**
 * Unit tests for GeoGebra activity iDevice (edition)
 *
 * The form laid out in the shared tabs is built with the real shared edition
 * object; only the application's tooltips and Bootstrap stand in.
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runInThisContext } from 'vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('geogebra-activity iDevice (edition)', () => {
  let $exeDevice;

  beforeEach(() => {
    global.$exeDevice = undefined;
    document.body.innerHTML = '';
    $exeDevice = global.loadIdevice(join(__dirname, 'geogebra-activity.js'));
  });

  afterEach(() => {
    global.$exeDevice = undefined;
  });

  it('includes ShowTitle option enabled by default', () => {
    expect($exeDevice.trueFalseOptions.ShowTitle).toBeDefined();
    expect($exeDevice.trueFalseOptions.ShowTitle[1]).toBe(true);
  });

  it('includes ShowAuthor option enabled by default', () => {
    expect($exeDevice.trueFalseOptions.ShowAuthor).toBeDefined();
    expect($exeDevice.trueFalseOptions.ShowAuthor[1]).toBe(true);
  });

  it('restores title link and showTitle flag from saved metadata', () => {
    document.body.innerHTML = `
      <input id="geogebraActivityLang" value="en" />
      <input id="geogebraActivityURL" value="" />
      <input id="geogebraActivitySCORM" type="checkbox" />
      <div id="geogebraActivitySCORMoptions" class="d-none"></div>
      <div id="geogebraActivitySCORMinstructions" class="d-none"></div>
      <div id="geogebraActivityWeightDiv" class="d-none"></div>
      <textarea id="eXeGameInstructions"></textarea>
      <textarea id="eXeIdeviceTextAfter"></textarea>
      <span id="geogebraActivityAuthorURL"></span>
      <span id="geogebraActivityTitle"></span>
      <input id="geogebraActivityShowTitle" type="checkbox" checked />
      <input id="geogebraActivityShowAuthor" type="checkbox" checked />
      <input id="geogebraActivityEvaluation" type="checkbox" />
      <input id="geogebraActivityEvaluationID" value="" />
    `;

    const author = escape('Ada Lovelace');
    const titleUrl = escape('https://www.geogebra.org/m/VgHhQXCC');
    const title = escape('Pendiente de una recta');
    const authLabel = escape('Authorship');
    const titleLabel = escape('Title');

    $exeDevice.idevicePreviousData = `
      <div class="auto-geogebra auto-geogebra-VgHhQXCC">
        <div class="auto-geogebra-author js-hidden">${author},${titleUrl},${title},1,${authLabel},0,${titleLabel}</div>
      </div>
    `;

    $exeDevice.loadPreviousValues();

    expect($('#geogebraActivityAuthorURL').text()).toBe('Ada Lovelace');
    expect($('#geogebraActivityTitle a').text()).toBe('Pendiente de una recta');
    expect($('#geogebraActivityTitle a').prop('href')).toContain('/m/VgHhQXCC');
    expect($('#geogebraActivityShowTitle').prop('checked')).toBe(false);
  });

  it('restores showAuthor option from saved classes', () => {
    document.body.innerHTML = `
      <input id="geogebraActivityLang" value="en" />
      <input id="geogebraActivityURL" value="" />
      <input id="geogebraActivitySCORM" type="checkbox" />
      <div id="geogebraActivitySCORMoptions" class="d-none"></div>
      <div id="geogebraActivitySCORMinstructions" class="d-none"></div>
      <div id="geogebraActivityWeightDiv" class="d-none"></div>
      <textarea id="eXeGameInstructions"></textarea>
      <textarea id="eXeIdeviceTextAfter"></textarea>
      <span id="geogebraActivityAuthorURL"></span>
      <span id="geogebraActivityTitle"></span>
      <input id="geogebraActivityShowTitle" type="checkbox" checked />
      <input id="geogebraActivityShowAuthor" type="checkbox" checked />
      <input id="geogebraActivityEvaluation" type="checkbox" />
      <input id="geogebraActivityEvaluationID" value="" />
    `;

    $exeDevice.idevicePreviousData = `
      <div class="auto-geogebra auto-geogebra-VgHhQXCC ShowAuthor0">
        <div class="auto-geogebra-author js-hidden">${escape('Ada Lovelace')},${escape('https://www.geogebra.org/m/VgHhQXCC')},${escape('Pendiente de una recta')},0,${escape('Authorship')},1,${escape('Title')}</div>
      </div>
    `;

    $exeDevice.loadPreviousValues();

    expect($('#geogebraActivityShowAuthor').prop('checked')).toBe(false);
  });

  it('populates shared progressBar fields when auto-geogebra-evaluation-id is set', () => {
    document.body.innerHTML = `
      <input id="geogebraActivityLang" value="en" />
      <input id="geogebraActivityURL" value="" />
      <input id="geogebraActivitySCORM" type="checkbox" />
      <div id="geogebraActivitySCORMoptions" class="d-none"></div>
      <div id="geogebraActivitySCORMinstructions" class="d-none"></div>
      <div id="geogebraActivityWeightDiv" class="d-none"></div>
      <textarea id="eXeGameInstructions"></textarea>
      <textarea id="eXeIdeviceTextAfter"></textarea>
      <span id="geogebraActivityAuthorURL"></span>
      <span id="geogebraActivityTitle"></span>
      <input id="geogebraActivityShowTitle" type="checkbox" />
      <input id="geogebraActivityShowAuthor" type="checkbox" />
      <input id="eXeProgressReport" type="checkbox" />
      <input id="eXeProgressReportID" disabled value="" />
    `;

    $exeDevice.idevicePreviousData = `
      <div class="auto-geogebra auto-geogebra-VgHhQXCC auto-geogebra-evaluation-id-myReport123 auto-geogebra-ideviceid-id1"></div>
    `;

    $exeDevice.loadPreviousValues();

    expect($('#eXeProgressReport').prop('checked')).toBe(true);
    expect($('#eXeProgressReportID').val()).toBe('myReport123');
    expect($('#eXeProgressReportID').prop('disabled')).toBe(false);
  });

  it('does not enable progressBar when evaluation id is 0', () => {
    document.body.innerHTML = `
      <input id="geogebraActivityLang" value="en" />
      <input id="geogebraActivityURL" value="" />
      <input id="geogebraActivitySCORM" type="checkbox" />
      <div id="geogebraActivitySCORMoptions" class="d-none"></div>
      <div id="geogebraActivitySCORMinstructions" class="d-none"></div>
      <div id="geogebraActivityWeightDiv" class="d-none"></div>
      <textarea id="eXeGameInstructions"></textarea>
      <textarea id="eXeIdeviceTextAfter"></textarea>
      <span id="geogebraActivityAuthorURL"></span>
      <span id="geogebraActivityTitle"></span>
      <input id="geogebraActivityShowTitle" type="checkbox" />
      <input id="geogebraActivityShowAuthor" type="checkbox" />
      <input id="eXeProgressReport" type="checkbox" />
      <input id="eXeProgressReportID" disabled value="" />
    `;

    $exeDevice.idevicePreviousData = `
      <div class="auto-geogebra auto-geogebra-VgHhQXCC auto-geogebra-evaluation-id-0"></div>
    `;

    $exeDevice.loadPreviousValues();

    expect($('#eXeProgressReport').prop('checked')).toBe(false);
    expect($('#eXeProgressReportID').val()).toBe('');
  });

  describe('display size controls', () => {
    function buildSizeFieldsDom() {
      return `
        <input id="geogebraActivityLang" value="en" />
        <input id="geogebraActivityURL" value="" />
        <input id="geogebraActivitySCORM" type="checkbox" />
        <div id="geogebraActivitySCORMoptions" class="d-none"></div>
        <div id="geogebraActivitySCORMinstructions" class="d-none"></div>
        <div id="geogebraActivityWeightDiv" class="d-none"></div>
        <textarea id="eXeGameInstructions"></textarea>
        <textarea id="eXeIdeviceTextAfter"></textarea>
        <span id="geogebraActivityAuthorURL"></span>
        <span id="geogebraActivityTitle"></span>
        <input id="geogebraActivityShowTitle" type="checkbox" />
        <input id="geogebraActivityShowAuthor" type="checkbox" />
        <input id="geogebraActivityEvaluation" type="checkbox" />
        <input id="geogebraActivityEvaluationID" value="" />
        <input id="geogebraActivityWidth" />
        <input id="geogebraActivityHeight" />
      `;
    }

    it('restores width and height from saved size classes', () => {
      document.body.innerHTML = buildSizeFieldsDom();

      $exeDevice.idevicePreviousData = `
        <div class="auto-geogebra auto-geogebra-VgHhQXCC auto-geogebra-width-800 auto-geogebra-height-600"></div>
      `;

      $exeDevice.loadPreviousValues();

      expect($('#geogebraActivityWidth').val()).toBe('800');
      expect($('#geogebraActivityHeight').val()).toBe('600');
    });

    it('leaves width and height empty for legacy content without explicit size classes', () => {
      document.body.innerHTML = buildSizeFieldsDom();

      $exeDevice.idevicePreviousData = `
        <div class="auto-geogebra auto-geogebra-VgHhQXCC"></div>
      `;

      $exeDevice.loadPreviousValues();

      expect($('#geogebraActivityWidth').val()).toBe('');
      expect($('#geogebraActivityHeight').val()).toBe('');
    });

    function buildSaveDom({ width, height }) {
      return `
        <input id="geogebraActivityLang" value="en" />
        <input id="geogebraActivityURL" value="VgHhQXCC" />
        <input id="geogebraActivitySCORM" type="checkbox" />
        <input id="geogebraActivityBorderColor" value="" />
        <input id="geogebraActivityScale" value="100" />
        <input id="geogebraActivityWeight" value="100" />
        <input id="geogebraActivityWidth" value="${width}" />
        <input id="geogebraActivityHeight" value="${height}" />
        <span id="geogebraActivityAuthorURL"></span>
        <span id="geogebraActivityTitle"></span>
      `;
    }

    it('save() emits auto-geogebra-width/height classes for provided values', () => {
      document.body.innerHTML = buildSaveDom({ width: '800', height: '600' });

      const tinymceGet = vi.spyOn(global.tinymce, 'get').mockImplementation(() => ({ getContent: () => '' }));

      try {
        const html = $exeDevice.save();
        expect(html).toContain('auto-geogebra-width-800');
        expect(html).toContain('auto-geogebra-height-600');
      } finally {
        tinymceGet.mockRestore();
      }
    });

    it('save() omits size classes when width and height are left blank', () => {
      document.body.innerHTML = buildSaveDom({ width: '', height: '' });

      const tinymceGet = vi.spyOn(global.tinymce, 'get').mockImplementation(() => ({ getContent: () => '' }));

      try {
        const html = $exeDevice.save();
        expect(html).not.toContain('auto-geogebra-width-');
        expect(html).not.toContain('auto-geogebra-height-');
      } finally {
        tinymceGet.mockRestore();
      }
    });

    // Like every other text this iDevice shows the learner: translated when it
    // is saved, and kept in the positional list the export reads.
    it('save() appends the minimum score notice to the evaluation messages', () => {
      document.body.innerHTML = buildSaveDom({ width: '', height: '' });

      const tinymceGet = vi.spyOn(global.tinymce, 'get').mockImplementation(() => ({ getContent: () => '' }));

      try {
        const container = document.createElement('div');
        container.innerHTML = $exeDevice.save();
        const messages = container
          .querySelector('.auto-geogebra-messages-evaluation')
          .textContent.split(',')
          .map(message => unescape(message));

        // Last, after the save button's caption, so older content keeps its positions.
        expect(messages).toHaveLength(5);
        expect(messages[3]).toBe('Save score');
        expect(messages[4]).toBe('Minimum score needed to pass this activity: %s');
      } finally {
        tinymceGet.mockRestore();
      }
    });
  });

  /**
   * This iDevice stores nothing as JSON: its options live as CSS classes on its
   * own markup. The pass score follows that convention, and the asymmetry is
   * deliberate -- the class is written only for a customised mark, so "global"
   * leaves no trace and content saved before the option existed reads as global
   * without a migration.
   */
  describe('pass score wiring', () => {
    let source;

    beforeEach(() => {
      source = readFileSync(join(__dirname, 'geogebra-activity.js'), 'utf-8');
    });

    it('delegates the evaluation controls to the shared tab', () => {
      // It renders neither control itself any more: the Grading tab does.
      expect(source).not.toContain('passScore.getContents(');
      expect(source).not.toContain('progressBar.getContents(');
      expect(source).toMatch(/tabs\.getHtml\([\s\S]*grading: \{ hideautosave: true \}/);
    });

    it('hides the automatic mode, which this activity cannot do', () => {
      // A GeoGebra construction has no end of its own -- the learner may keep
      // dragging it forever -- so there is no moment at which to report on its
      // own. Only "do not save" and "show a button" are reachable.
      expect(source).toContain('hideautosave: true');
    });

    /**
     * Storage is the interesting part of this iDevice: it has no JSON options
     * block, so the SCORM settings ride on the same CSS classes as everything
     * else. Nothing new had to be invented for the Grading tab, because the
     * set of reachable states did not grow -- it is still "button" or nothing,
     * which auto-geogebra-scorm already encoded. That is what keeps existing
     * content readable without a migration.
     */
    /**
     * The editor re-injects an iDevice's edition file with a <script> tag every
     * time the author opens it, so a second edition re-runs the whole file in
     * the same realm. `var $exeDevice` is redeclarable and survives that; a
     * top-level `const` throws "Identifier has already been declared" and the
     * form never renders again until the page is reloaded.
     *
     * This bit the pass-score class, which shipped as a module-level const and
     * broke the second edition of any GeoGebra activity.
     */
    it('declares nothing at the top level that a re-run would clash with', () => {
      const topLevelBindings = source.match(/^(const|let|class)\s/gm) ?? [];

      expect(topLevelBindings).toHaveLength(0);
      expect(source).toContain('var $exeDevice');
    });

    it('keeps storing the mode in the class it always used', () => {
      expect(source).toContain("css += ' auto-geogebra-scorm'");
      expect(source).toContain("div.hasClass('auto-geogebra-scorm')");
      // No second class for the mode: presence means button, absence means off.
      expect(source).not.toContain('auto-geogebra-scorm-mode');
    });

    it('takes the mode, the button text and the weight from the shared block', () => {
      expect(source).toContain('gamification.scorm.getValues()');
      expect(source).toContain('scorm.isScorm > 0');
      expect(source).toContain('buttonText = scorm.textButtonScorm');
      expect(source).toContain('weight = scorm.weighted');
    });

    it('feeds them back into the shared block when reopened', () => {
      expect(source).toContain('gamification.scorm.setValues(');
      expect(source).toContain('scormMode = 2');
      expect(source).toContain("scormWeight = part.replace('auto-geogebra-weight-'");
    });

    it('no longer keeps a save-score toggle of its own', () => {
      // Two controls for one setting is how they end up contradicting.
      expect(source).not.toContain('geogebraActivitySCORM');
      expect(source).not.toContain('geogebraActivityWeight');
    });

    it('writes a class only for a customised mark', () => {
      expect(source).toContain("if (passScore.passScoreMode === 'custom')");
      expect(source).toContain("css += ' ' + $exeDevice.passScoreClass + passScore.passScoreCustom");
    });

    it('reads the class back as the custom mode', () => {
      expect(source).toContain('gamification.passScore.setValues(');
      expect(source).toContain("passScoreMode: 'custom'");
      expect(source).toContain('part.replace($exeDevice.passScoreClass');
    });

    it('takes the mark from the shared control when saving', () => {
      expect(source).toContain('gamification.passScore.getValues()');
    });

    it('wires the radio and input handlers', () => {
      expect(source).toContain('gamification.passScore.addEvents()');
    });
  });

  describe('edition lifecycle', () => {
    let handlers;
    let abort;

    beforeEach(() => {
      document.body.innerHTML = `
        <input id="geogebraActivityURL" value="VgHhQXCC" />
        <input id="geogebraActivityWidth" value="" />
        <input id="geogebraActivityHeight" value="" />
        <span id="geogebraActivityAuthorURL"></span>
        <span id="geogebraActivityTitle"></span>
      `;
      handlers = null;
      abort = vi.fn();
      vi.spyOn($, 'ajax').mockImplementation((options) => {
        handlers = options;
        return { abort };
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const answer = {
      responses: {
        response: {
          item: {
            width: '800',
            height: '600',
            author: 'Ada Lovelace',
            url: 'https://www.geogebra.org/m/VgHhQXCC',
            title: 'Pendiente de una recta',
            visibility: 'O',
          },
        },
      },
    };

    it('fills the form when the lookup answers while the editor is open', () => {
      $exeDevice.loadData('VgHhQXCC', 'https://www.geogebra.org/m/VgHhQXCC');

      handlers.success(answer);

      expect($('#geogebraActivityWidth').val()).toBe('800');
      expect($('#geogebraActivityAuthorURL').text()).toBe('Ada Lovelace');
    });

    it('aborts the pending lookup when the edition closes', () => {
      $exeDevice.loadData('VgHhQXCC', 'https://www.geogebra.org/m/VgHhQXCC');

      expect(abort).not.toHaveBeenCalled();

      $exeDevice.$lifecycle.destroy();

      expect(abort).toHaveBeenCalledTimes(1);
    });

    it('ignores a lookup that answers after the edition closed', () => {
      $exeDevice.loadData('VgHhQXCC', 'https://www.geogebra.org/m/VgHhQXCC');
      $exeDevice.$lifecycle.destroy();

      handlers.success(answer);

      expect($('#geogebraActivityWidth').val()).toBe('');
      expect($('#geogebraActivityAuthorURL').text()).toBe('');
    });

    it('does not report an error raised by its own abort', () => {
      const errorMessage = vi.spyOn($exeDevice, 'errorMessage');

      $exeDevice.loadData('VgHhQXCC', 'https://www.geogebra.org/m/VgHhQXCC');
      // jQuery calls the error handler synchronously when a request is aborted.
      abort.mockImplementation(() => handlers.error());
      $exeDevice.$lifecycle.destroy();

      expect(errorMessage).not.toHaveBeenCalled();
    });
  });
});

describe('geogebra-activity edition: shared form tabs', () => {
    const PATH = '/files/perm/idevices/base/geogebra-activity/edition/';
    const panel = (name) => document.getElementById(`eXeAutoGeogebraForm-panel-${name}`);
    const stored = `
        <div class="auto-geogebra auto-geogebra-VgHhQXCC auto-geogebra-width-800 auto-geogebra-height-600 language-fr showMenuBar auto-geogebra-scale-80 auto-geogebra-evaluation-id-0 auto-geogebra-weight-100">
            <div class="auto-geogebra-instructions"><p>Move the point</p></div>
            <div class="auto-geogebra-extra-content"><p>Well done</p></div>
        </div>`;
    let device;
    let previousApp;
    let tooltips;

    beforeEach(() => {
        global.$exeDevice = undefined;
        previousApp = global.eXeLearning.app;
        tooltips = new Map();
        global.eXeLearning.app = {
            ...previousApp,
            common: {
                initTooltips: vi.fn((scope) => {
                    scope.querySelectorAll('.exe-app-tooltip').forEach((button) => {
                        if (!tooltips.has(button)) tooltips.set(button, { hide: vi.fn(), dispose: vi.fn() });
                    });
                }),
            },
        };
        vi.stubGlobal('bootstrap', { Tooltip: { getInstance: (button) => tooltips.get(button) } });
        document.body.innerHTML = '<div id="geogebraBody"></div>';
        const filename = join(__dirname, 'geogebra-activity.js');
        runInThisContext(readFileSync(filename, 'utf8'), { filename });
        device = global.$exeDevice;
        global.attachEditionLifecycle(device);
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        global.eXeLearning.app = previousApp;
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    const open = (previousData = '') => device.init(document.getElementById('geogebraBody'), previousData, PATH);

    it('lays the form out in the shared tabs, and opens on the activity', () => {
        open();
        const tabNames = [...document.querySelectorAll('#eXeAutoGeogebraForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );

        expect(tabNames).toEqual(['instructions', 'options', 'contents', 'after', 'grading']);
        expect(panel('contents').classList.contains('active')).toBe(true);
    });

    it('puts each part of the form in its tab', () => {
        open();

        expect(panel('instructions').querySelector('#eXeGameInstructions')).not.toBeNull();
        expect(panel('options').querySelector('#geogebraActivityLang')).not.toBeNull();
        expect(panel('options').querySelector('#geogebraActivityShowAuthor')).not.toBeNull();
        expect(panel('contents').querySelector('#geogebraActivityURL')).not.toBeNull();
        expect(panel('contents').querySelector('#geogebraActivitySize')).not.toBeNull();
        expect(panel('after').querySelector('#eXeIdeviceTextAfter')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(document.querySelectorAll('[data-exe-share], #eXeAutoGeogebraForm fieldset')).toHaveLength(0);
    });

    it('keeps the size controls visible', () => {
        open();
        const sizeBlock = panel('contents').querySelector('#geogebraActivitySize');

        expect(sizeBlock.classList.contains('d-none')).toBe(false);
        expect(sizeBlock.classList.contains('d-flex')).toBe(true);
    });

    it('offers only the button among the ways of saving the score', () => {
        open();

        expect(panel('grading').querySelector('#eXeGameSCORMAutomatically').classList.contains('d-none')).toBe(true);
    });

    it('provides one accessible information button in each options row', () => {
        open();
        const options = panel('options');
        const helpButtons = [...options.querySelectorAll('#eXeAutoGeogebraOptions .exe-idevice-help')];
        const state = () => [...options.querySelectorAll('input')].map((input) => `${input.checked}${input.value}`);

        expect(helpButtons).toHaveLength(3 + Object.keys(device.trueFalseOptions).length);
        for (const help of helpButtons) {
            expect(help.closest('.d-flex').lastElementChild.contains(help)).toBe(true);
            expect(help.getAttribute('aria-label')).toBe(help.title);
            expect(document.getElementById(help.getAttribute('aria-controls')).textContent.length).toBeGreaterThan(30);
            const before = state();
            help.click();
            document.getElementById(help.getAttribute('aria-controls')).click();
            expect(state()).toEqual(before);
        }
    });

    it('disposes all option tooltips when the edition closes', () => {
        open();

        expect(tooltips.size).toBe(document.querySelectorAll('#eXeAutoGeogebraForm .exe-app-tooltip').length);
        expect(tooltips.size).toBeGreaterThanOrEqual(18);
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('leaves the state of each switch to its native checkbox', () => {
        open();

        document.querySelectorAll('.toggle-input:not(:disabled)').forEach((input) => input.click());

        expect(document.querySelectorAll('[role="switch"], [aria-checked]')).toHaveLength(0);
    });

    it('reopens a saved activity, its instructions included, and saves them where they were', () => {
        open(stored);

        expect(document.getElementById('geogebraActivityURL').value).toBe('https://www.geogebra.org/m/VgHhQXCC');
        expect(document.getElementById('geogebraActivityLang').value).toBe('fr');
        expect(document.getElementById('geogebraActivityshowMenuBar').checked).toBe(true);
        expect(document.getElementById('geogebraActivityScale').value).toBe('80');
        expect(document.getElementById('eXeGameInstructions').value).toBe('<p>Move the point</p>');
        const editors = {
            eXeGameInstructions: '<p>Move the point</p>',
            eXeIdeviceTextAfter: '<p>Well done</p>',
        };
        vi.spyOn(global.tinymce, 'get').mockImplementation((id) =>
            id in editors ? { getContent: () => editors[id] } : null
        );

        const html = device.save();

        expect(html).toContain('<div class="auto-geogebra-instructions"><p>Move the point</p></div>');
        expect(html).toContain('<div class="auto-geogebra-extra-content"><p>Well done</p></div>');
        expect(html).toContain('language-fr');
        expect(html).toContain(' showMenuBar');
        expect(html).not.toContain('exe-idevice-help');
    });
});
