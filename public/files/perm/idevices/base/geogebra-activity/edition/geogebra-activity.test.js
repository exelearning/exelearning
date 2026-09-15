/**
 * Unit tests for GeoGebra activity iDevice (edition)
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
      <textarea id="geogebraActivityInstructions"></textarea>
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
      <textarea id="geogebraActivityInstructions"></textarea>
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
      <textarea id="geogebraActivityInstructions"></textarea>
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
      <textarea id="geogebraActivityInstructions"></textarea>
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
        <textarea id="geogebraActivityInstructions"></textarea>
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

    it('renders createForm() with the size controls visible (not hidden)', () => {
      document.body.innerHTML = '<div id="geogebra_body_create_form"></div>';
      $exeDevice.ideviceBody = document.getElementById('geogebra_body_create_form');

      globalThis.$exeDevicesEdition.iDevice.common = {
        getIdeviceDescription: vi.fn(() => '<div class="alert alert-info"></div>'),
        getTextFieldset: vi.fn(() => ''),
      };

      $exeDevice.createForm();

      const sizeBlock = $exeDevice.ideviceBody.querySelector('#geogebraActivitySize');
      expect(sizeBlock).not.toBeNull();
      expect(sizeBlock.classList.contains('d-none')).toBe(false);
      expect(sizeBlock.classList.contains('d-flex')).toBe(true);

      const widthInput = $exeDevice.ideviceBody.querySelector('#geogebraActivityWidth');
      const heightInput = $exeDevice.ideviceBody.querySelector('#geogebraActivityHeight');
      expect(widthInput).not.toBeNull();
      expect(heightInput).not.toBeNull();
    });

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

      const previousEditors = global.tinymce.editors;
      global.tinymce.editors = [{ getContent: () => '' }, { getContent: () => '' }];

      try {
        const html = $exeDevice.save();
        expect(html).toContain('auto-geogebra-width-800');
        expect(html).toContain('auto-geogebra-height-600');
      } finally {
        global.tinymce.editors = previousEditors;
      }
    });

    it('save() omits size classes when width and height are left blank', () => {
      document.body.innerHTML = buildSaveDom({ width: '', height: '' });

      const previousEditors = global.tinymce.editors;
      global.tinymce.editors = [{ getContent: () => '' }, { getContent: () => '' }];

      try {
        const html = $exeDevice.save();
        expect(html).not.toContain('auto-geogebra-width-');
        expect(html).not.toContain('auto-geogebra-height-');
      } finally {
        global.tinymce.editors = previousEditors;
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
      // It renders neither control itself any more: the Evaluation tab does.
      expect(source).not.toContain('passScore.getContents(');
      expect(source).not.toContain('progressBar.getContents(');
      expect(source).toContain('gamification.scorm.getTab(');
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
     * else. Nothing new had to be invented for the Evaluation tab, because the
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
});
